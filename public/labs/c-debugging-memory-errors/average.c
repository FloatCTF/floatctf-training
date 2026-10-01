#include <stdio.h>

int average(const int *values, int count) {
    int sum = 0;
    for (int i = 1; i < count; i++) {
        sum = sum + values[i];
    }
    return sum / count;
}

int main(void) {
    int scores[4] = {80, 90, 70, 100};
    printf("average %d\n", average(scores, 4));
    return 0;
}
