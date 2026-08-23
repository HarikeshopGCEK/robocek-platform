#pragma once

#include <Arduino.h>

namespace RC {

struct UltrasonicDistance {
    float left;
    float right;
};

class UltrasonicController {
public:
    void begin();

    UltrasonicDistance read();

private:
    uint8_t _leftTrig;
    uint8_t _leftEcho;

    uint8_t _rightTrig;
    uint8_t _rightEcho;

    float readSensor(
        uint8_t trigPin,
        uint8_t echoPin
    );
};

extern UltrasonicController Ultrasonic;

}