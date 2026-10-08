#include <stdio.h>

int main(void) {
    int total = 0;
    for (int i = 1; i <= 4; i++) {
        total = total + i;
    }
    printf("%d\n", total);

    int n = 27;
    int steps = 0;
    while (n != 1) {
        if (n % 2 == 0) {
            n = n / 2;
        } else {
            n = 3 * n + 1;
        }
        steps++;
    }
    printf("%d\n", steps);
    return 0;
}
