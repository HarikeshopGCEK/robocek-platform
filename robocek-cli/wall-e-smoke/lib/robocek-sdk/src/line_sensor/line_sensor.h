#pragma once

#include <Arduino.h>

namespace RC {

class LineSensorController {
public:

    void begin();

    bool isLeftDetected();
    bool isRightDetected();

private:

    uint8_t _leftPin;
    uint8_t _rightPin;
};

extern LineSensorController LineSensor;

}