#pragma once

#include "motor/motor.h"

namespace RC {

inline void begin() {
    Motor.begin();
}

}