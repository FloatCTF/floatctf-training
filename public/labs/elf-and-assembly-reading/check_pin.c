#include <stdio.h>
#include <stdlib.h>

int compute_code(int a, int b) {
    return a * 3 + b;
}

int check_pin(int input) {
    int target = compute_code(1400, 226);
    if (input == target) {
        return 1;
    }
    return 0;
}

int main(int argc, char **argv) {
    if (argc < 2) {
        puts("Usage: ./check_pin <number>");
        return 2;
    }
    int pin = atoi(argv[1]);
    if (check_pin(pin)) {
        puts("PIN OK: welcome to the lab");
        return 0;
    }
    puts("PIN DENIED");
    return 1;
}
