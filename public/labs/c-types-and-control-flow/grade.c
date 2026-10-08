#include <stdio.h>

int main(void) {
    int score;
    printf("score: ");
    scanf("%d", &score);
    if (score >= 90) {
        printf("excellent\n");
    } else if (score >= 60) {
        printf("pass\n");
    } else {
        printf("fail\n");
    }
    return 0;
}
