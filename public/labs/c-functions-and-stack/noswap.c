#include <stdio.h>

void swap(int a, int b) {
    int tmp = a;
    a = b;
    b = tmp;
}

int main(void) {
    int x = 3;
    int y = 5;
    swap(x, y);
    printf("%d %d\n", x, y);
    return 0;
}
