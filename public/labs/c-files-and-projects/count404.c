#include <stdio.h>
#include <string.h>

int main(void) {
    FILE *log = fopen("access.log", "r");
    if (log == NULL) {
        perror("access.log");
        return 1;
    }

    char line[256];
    int total = 0;
    int missing = 0;
    while (fgets(line, sizeof(line), log) != NULL) {
        total++;
        if (strstr(line, "\" 404 ") != NULL) {
            missing++;
        }
    }
    fclose(log);

    printf("%d lines, %d not found\n", total, missing);
    return 0;
}
