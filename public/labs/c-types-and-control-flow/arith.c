#include <stdio.h>

int main(void) {
    int a = 7;
    int b = 2;
    printf("%d\n", a / b);
    printf("%d\n", a % b);
    printf("%f\n", 7.0 / 2);
    char c = 'A';
    printf("%c %d\n", c, c);
    c = c + 1;
    printf("%c %d\n", c, c);
    return 0;
}
