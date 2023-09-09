#!/bin/bash

fswatch -o ./src/ | xargs -n1 -I{} ./build.sh
