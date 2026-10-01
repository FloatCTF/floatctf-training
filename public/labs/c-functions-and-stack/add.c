#include <stdio.h>

int add(int a, int b) {
    int sum = a + b;
    return sum;
}

int main(void) {
    int x = 3;
    int y = 4;
    int result = add(x, y);
    printf("%d\n", result);
    return 0;
}
