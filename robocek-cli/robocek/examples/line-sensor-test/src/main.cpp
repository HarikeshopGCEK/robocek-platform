#include <Arduino.h>
#include <robocek.h>

void setup()
{
    Serial.begin(115200);

    delay(1000);

    Serial.println();
    Serial.println("==============================");
    Serial.println("   ROBOCEK LINE SENSOR TEST");
    Serial.println("==============================");

    RC::LineSensor.begin();
}

void loop()
{
    bool left = RC::LineSensor.isLeftDetected();
    bool right = RC::LineSensor.isRightDetected();

    Serial.print("Left: ");
    Serial.print(left);

    Serial.print(" | Right: ");
    Serial.println(right);

    delay(200);
}