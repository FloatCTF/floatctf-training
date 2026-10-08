#include <stdio.h>

int main(void) {
    int codes[3] = {200, 404, 500};
    for (int i = 0; i <= 3; i++) {
        printf("%d\n", codes[i]);
    }
    return 0;
}
