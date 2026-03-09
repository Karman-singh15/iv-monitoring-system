#include <Servo.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

const int irPin = 2;
const int servoPin = 9;
const int ledPin = 6;
const int buzzerPin = 7;

const unsigned long timeout = 5000;

Servo motor;
LiquidCrystal_I2C lcd(0x27,16,2);

bool flowActive = true;
bool lastSensor = HIGH;

unsigned long lastDropTime = 0;

int heartRate = 72;
int spo2 = 98;

// safety thresholds
int HR_LOW = 50;
int HR_HIGH = 120;
int SPO2_LOW = 90;

void setup() {

  Serial.begin(9600);

  pinMode(irPin, INPUT);
  pinMode(ledPin, OUTPUT);
  pinMode(buzzerPin, OUTPUT);

  motor.attach(servoPin);
  motor.write(0);

  lcd.init();
  lcd.backlight();

  lastDropTime = millis();
}

void updateLCD(){

  lcd.setCursor(0,0);
  lcd.print("HR:");
  lcd.print(heartRate);
  lcd.print(" SP:");
  lcd.print(spo2);
  lcd.print("  ");

  lcd.setCursor(0,1);

  if(flowActive){
    lcd.print("Flow: RUNNING ");
  } else {
    lcd.print("Flow: STOPPED ");
  }
}

void stopFlow(){

  motor.write(90);
  flowActive = false;

  digitalWrite(ledPin,HIGH);
  digitalWrite(buzzerPin,HIGH);

  Serial.println("FLOW_STOPPED");
}

void startFlow(){

  motor.write(0);
  flowActive = true;

  digitalWrite(ledPin,LOW);
  digitalWrite(buzzerPin,LOW);

  Serial.println("FLOW_RUNNING");
}

void loop(){

  // Receive HR & SPO2 from website
  if(Serial.available()){

    String cmd = Serial.readStringUntil('\n');

    if(cmd.startsWith("HR")){
      heartRate = cmd.substring(2).toInt();
    }

    if(cmd.startsWith("SP")){
      spo2 = cmd.substring(2).toInt();
    }

    updateLCD();
  }

  // Safety check
  if(heartRate < HR_LOW || heartRate > HR_HIGH || spo2 < SPO2_LOW){

    if(flowActive){
      stopFlow();
    }

  }

  // IR Drop detection
  bool sensor = digitalRead(irPin);

  if(lastSensor == HIGH && sensor == LOW){

    lastDropTime = millis();

    if(!flowActive){
      startFlow();
    }

    Serial.println("DROP");
  }

  lastSensor = sensor;

  // Flow timeout detection
  if(flowActive && millis() - lastDropTime >= timeout){

    stopFlow();
  }

  updateLCD();

  delay(500);
}