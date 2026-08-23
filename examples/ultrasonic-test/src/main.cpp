#include <Arduino.h>
#include <robocek.h>

void setup()
{
    Serial.begin(115200);

    delay(500);

    Serial.println();
    Serial.println("==============================");
    Serial.println("    ROBOCEK ULTRASONIC TEST");
    Serial.println("==============================");

    RC::Ultrasonic.begin();
}

void loop()
{
    auto distance = RC::Ultrasonic.read();

    Serial.print("Left: ");

    if (distance.left < 0) {
        Serial.print("TIMEOUT");
    } else {
        Serial.print(distance.left);
        Serial.print(" cm");
    }

    Serial.print(" | Right: ");

    if (distance.right < 0) {
        Serial.print("TIMEOUT");
    } else {
        Serial.print(distance.right);
        Serial.print(" cm");
    }

    Serial.println();

    delay(200);
}