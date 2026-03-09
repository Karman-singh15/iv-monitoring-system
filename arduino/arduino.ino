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

// -------- Added HR and SPO2 --------
int heartRate = 72;
int spo2 = 98;

// Safety thresholds
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

  lcd.setCursor(0,0);
  lcd.print("IV Monitor");

  delay(2000);
  lcd.clear();

  lastDropTime = millis();
}

void loop() {

  // -------- Receive HR and SPO2 from website --------
  if(Serial.available()){

    String cmd = Serial.readStringUntil('\n');

    if(cmd.startsWith("HR")){
      heartRate = cmd.substring(2).toInt();
    }

    if(cmd.startsWith("SP")){
      spo2 = cmd.substring(2).toInt();
    }
  }

  // -------- Display HR and SPO2 --------
  lcd.setCursor(0,1);
  lcd.print("HR:");
  lcd.print(heartRate);
  lcd.print(" SP:");
  lcd.print(spo2);
  lcd.print("  ");

  // -------- Patient Safety Check --------
  if(heartRate < HR_LOW || heartRate > HR_HIGH || spo2 < SPO2_LOW){

    if(flowActive){

      motor.write(90);  // close IV
      flowActive = false;

      digitalWrite(ledPin, HIGH);
      digitalWrite(buzzerPin, HIGH);

      lcd.setCursor(0,0);
      lcd.print("PATIENT ALERT ");
    }
  }

  // -------- IR Drop Detection --------
  bool sensor = digitalRead(irPin);

  if(lastSensor == HIGH && sensor == LOW){

    lastDropTime = millis();

    if(!flowActive && heartRate >= HR_LOW && heartRate <= HR_HIGH && spo2 >= SPO2_LOW){

      motor.write(0);  // open IV
      flowActive = true;

      digitalWrite(ledPin, LOW);
      digitalWrite(buzzerPin, LOW);

      lcd.setCursor(0,0);
      lcd.print("Flow Resumed   ");
    }

    Serial.println("Drop detected");

    delay(60);
  }

  lastSensor = sensor;

  // -------- Flow Stop Detection --------
  if(flowActive && millis() - lastDropTime >= timeout){

    motor.write(90);  // close IV
    flowActive = false;

    digitalWrite(ledPin, HIGH);
    digitalWrite(buzzerPin, HIGH);

    lcd.setCursor(0,0);
    lcd.print("FLOW STOPPED!  ");
  }
}