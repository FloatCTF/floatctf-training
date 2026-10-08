#include <stdio.h>

int down(int n) {
    return down(n + 1) + 1;
}

int main(void) {
    printf("%d\n", down(0));
    return 0;
}
