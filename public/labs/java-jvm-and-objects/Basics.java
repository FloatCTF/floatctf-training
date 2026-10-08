public class Basics {
    // 一个方法：参数和返回值都要写明类型
    static int square(int x) {
        return x * x;
    }

    public static void main(String[] args) {
        int count = 3;
        double price = 9.5;
        boolean ok = count > 2;
        String name = "kali";
        System.out.println(name + " has " + count + " items, total " + count * price + ", ok=" + ok);

        int[] scores = {90, 75, 88};
        int sum = 0;
        for (int i = 0; i < scores.length; i++) {
            sum += scores[i];
        }
        System.out.println("sum=" + sum + ", average=" + sum / scores.length);
        System.out.println("square(12)=" + square(12));
        System.out.println(name.toUpperCase() + " " + name.length());
    }
}
