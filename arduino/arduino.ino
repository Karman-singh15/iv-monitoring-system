#include <Servo.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

const int irPin = 2;
const int servoPin = 9;
const int ledPin = 6;
const int buzzerPin = 7;
const int lm35Pin = A0;

const unsigned long timeout = 5000;

Servo motor;
LiquidCrystal_I2C lcd(0x27,16,2);

bool flowActive = true;
bool lastSensor = HIGH;

unsigned long lastDropTime = 0;

int heartRate = 72;
int spo2 = 98;

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

  // -------- Receive commands from website --------
  if(Serial.available()){

    String cmd = Serial.readStringUntil('\n');

    if(cmd.startsWith("HR")){
      heartRate = cmd.substring(2).toInt();
    }

    if(cmd.startsWith("SP")){
      spo2 = cmd.substring(2).toInt();
    }

    lcd.setCursor(0,0);
    lcd.print("HR:");
    lcd.print(heartRate);
    lcd.print(" SPO2:");
    lcd.print(spo2);
  }

  // -------- Temperature --------
  int sensorValue = analogRead(lm35Pin);
  float voltage = sensorValue * (5.0 / 1023.0);
  float temperature = voltage * 100;

  Serial.print("TEMP:");
  Serial.println(temperature);

  lcd.setCursor(0,1);
  lcd.print("Temp:");
  lcd.print(temperature);
  lcd.print("C ");

  // -------- IR Drop Detection --------
  bool sensor = digitalRead(irPin);

  if(lastSensor == HIGH && sensor == LOW){

    lastDropTime = millis();

    Serial.println("DROP");

    if(!flowActive){

      motor.write(0);
      flowActive = true;

      digitalWrite(ledPin, LOW);
      digitalWrite(buzzerPin, LOW);
    }

    delay(60);
  }

  lastSensor = sensor;

  // -------- Flow Stop --------
  if(flowActive && millis() - lastDropTime >= timeout){

    motor.write(90);
    flowActive = false;

    digitalWrite(ledPin, HIGH);
    digitalWrite(buzzerPin, HIGH);

    Serial.println("FLOW_STOPPED");
  }

  delay(1000);
}