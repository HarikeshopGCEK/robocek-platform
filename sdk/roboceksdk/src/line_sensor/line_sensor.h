#pragma once

#include <Arduino.h>
namespace RC {
    class LineSensor {
    public:
        LineSensor(int leftPin, int rightPin);
        void begin();
        bool isLeftDetected();
        bool isRightDetected();

    private:
        int _leftPin;
        int _rightPin;
    };
extern LineSensor LineSensorInstance;
}

