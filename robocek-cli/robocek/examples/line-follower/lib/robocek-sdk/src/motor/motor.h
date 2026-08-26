#pragma once

#include <Arduino.h>

namespace RC {

class MotorController {
public:
    void begin();

    void left(int speed);
    void right(int speed);

    void forward(int speed);
    void backward(int speed);

    void stop();
};

extern MotorController Motor;

}