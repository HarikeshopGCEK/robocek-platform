#pragma once

#include "motor/motor.h"
#include "line_sensor/line_sensor.h"

namespace RC {

inline void begin() {
    Motor.begin();
    LineSensor.begin();
}

}