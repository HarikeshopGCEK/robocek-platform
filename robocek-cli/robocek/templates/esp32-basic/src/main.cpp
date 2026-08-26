#include <Arduino.h>

void setup() {
    Serial.begin(115200);

    delay(1000);

    Serial.println();
    Serial.println("==============================");
    Serial.println("     ROBOCEK DEVICE ONLINE");
    Serial.println("==============================");
}

void loop() {
    Serial.println("ROBOCEK heartbeat...");
    delay(1000);
}