public class Student {
    // 字段：每个 Student 对象各有一份。private 表示只有这个类自己的代码能直接访问
    private String name;
    private int score;

    // 构造方法：名字和类名相同，没有返回值类型；new Student(...) 时执行
    public Student(String name, int score) {
        this.name = name;
        this.score = score;
    }

    public String getName() {
        return name;
    }

    public void addBonus(int points) {
        score += points;
    }

    public boolean passed() {
        return score >= 60;
    }

    // 把对象拼进字符串、交给 println 时，用的就是这个方法的返回值
    @Override
    public String toString() {
        return name + "(" + score + ")";
    }
}
