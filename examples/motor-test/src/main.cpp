#include <Arduino.h>
#include <robocek.h>

void setup() {

    Serial.begin(115200);

    delay(1000);

    Serial.println();
    Serial.println("==============================");
    Serial.println("      ROBOCEK MOTOR TEST");
    Serial.println("==============================");

    RC::Motor.begin();
}

void loop() {

    Serial.println("FORWARD");
    RC::Motor.forward(120);
    delay(2000);

    Serial.println("STOP");
    RC::Motor.stop();
    delay(1000);

    Serial.println("BACKWARD");
    RC::Motor.backward(120);
    delay(2000);

    Serial.println("STOP");
    RC::Motor.stop();
    delay(1000);

    Serial.println("LEFT");
    RC::Motor.left(120);
    delay(1500);

    Serial.println("STOP");
    RC::Motor.stop();
    delay(1000);

    Serial.println("RIGHT");
    RC::Motor.right(120);
    delay(1500);

    Serial.println("STOP");
    RC::Motor.stop();
    delay(2000);
}