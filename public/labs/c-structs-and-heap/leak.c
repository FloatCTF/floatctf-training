#include <stdio.h>
#include <stdlib.h>

int main(void) {
    for (int i = 0; i < 3; i++) {
        int *block = malloc(100);
        block[0] = i;
    }
    printf("done\n");
    return 0;
}
