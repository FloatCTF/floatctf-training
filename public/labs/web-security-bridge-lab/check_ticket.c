#include <stdio.h>
#include <stdlib.h>

int expected_ticket(int seed) {
    return seed * 4 + 17;
}

int main(int argc, char **argv) {
    if (argc < 2) {
        puts("Usage: ./check_ticket <number>");
        return 2;
    }
    int ticket = atoi(argv[1]);
    if (ticket == expected_ticket(500)) {
        puts("CHECKPOINT: elf-ok");
        return 0;
    }
    puts("INVALID TICKET");
    return 1;
}
