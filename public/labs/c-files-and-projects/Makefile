report: main.o stats.o
	gcc main.o stats.o -o report

main.o: main.c stats.h
	gcc -Wall -c main.c

stats.o: stats.c stats.h
	gcc -Wall -c stats.c

clean:
	rm -f report main.o stats.o
