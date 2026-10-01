#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int count = 3;
    int *scores = malloc(count * sizeof(int));
    if (scores == NULL) {
        return 1;
    }
    for (int i = 0; i < count; i++) {
        scores[i] = (i + 1) * 10;
    }
    printf("%d %d %d\n", scores[0], scores[1], scores[2]);
    free(scores);
    scores = NULL;
    return 0;
}
