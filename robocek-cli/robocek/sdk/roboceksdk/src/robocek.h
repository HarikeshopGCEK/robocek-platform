#pragma once

#include "motor/motor.h"
#include "line_sensor/line_sensor.h"
#include "ultrasonic/ultrasonic.h"

namespace RC {

inline void begin() {
    Motor.begin();
    LineSensor.begin();
    Ultrasonic.begin();
}

}