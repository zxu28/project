# Coding Challenge Projects

A collection of Python programs demonstrating various programming concepts and algorithms.

## 📁 Projects

### 1. Number Removal Game (`number_game.py`)
A strategic turn-based game where players compete to avoid removing the last number.

#### Features:
- **Random starting number** between 20-30
- **Turn-based gameplay** (Player vs Computer)
- **Optimal AI strategy** using game theory
- **Clean, minimal interface**
- **Play again functionality**

#### How to Play:
1. Run the program: `python3 number_game.py`
2. You and the computer take turns removing 1, 2, or 3 from the current number
3. The player who removes the last number (making it 0) **LOSES**
4. You go first!

#### Game Strategy:
The computer uses an optimal strategy based on multiples of 4:
- Forces opponent into "losing positions" (numbers where `n % 4 == 1`)
- Mathematically unbeatable when starting from a winning position

#### Example:
```
==============================
NUMBER REMOVAL GAME
==============================
Starting number: 25
Remove 1, 2, or 3. Last to remove LOSES!
==============================

Current number: 25
How many do you want to remove (1-3)? 2
You removed 2. 23 left.

Computer removes 2. 21 left.
```

### 2. Sentence Counter (`sentence_counter.py`)
A simple word counting utility for analyzing text input.

#### Features:
- **Word counting** in sentences
- **Simple input/output** interface
- **Multiple sentence analysis**
- **Clean, user-friendly design**

#### How to Use:
1. Run the program: `python3 sentence_counter.py`
2. Enter a sentence when prompted
3. View the word count
4. Option to analyze more sentences

#### Example:
```
==============================
SENTENCE COUNTER
==============================
Enter a sentence: Hello world this is a test

Word count: 6
==============================
```

## 🚀 Getting Started

### Prerequisites
- Python 3.6 or higher
- Git (for cloning the repository)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/zxu28/codingchallenge.git
   cd codingchallenge
   ```

2. Run any program:
   ```bash
   python3 number_game.py
   python3 sentence_counter.py
   ```

## 🎮 Game Theory Behind Number Removal Game

The Number Removal Game is based on the mathematical concept of **Nim games**. The optimal strategy involves:

- **Losing positions**: Numbers where `(number % 4) == 1`
- **Winning positions**: All other numbers
- **Optimal play**: Always move to force opponent into losing positions

This makes the computer nearly unbeatable when it starts from a winning position!

## 📊 Technical Details

### Number Game Algorithm:
```python
remainder = current_number % 4
if remainder == 1:
    computer_move = 1  # Defensive
elif remainder == 0:
    computer_move = min(3, current_number)  # Force losing position
elif remainder == 2:
    computer_move = 1  # Force losing position
else:  # remainder == 3
    computer_move = 2  # Force losing position
```

### Sentence Counter Algorithm:
```python
words = sentence.split()
word_count = len(words)
```

## 🛠️ Development

### File Structure:
```
codingchallenge/
├── README.md
├── number_game.py
└── sentence_counter.py
```

### Contributing:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 👨‍💻 Author

**Zixu (Serena)**
- GitHub: [@zxu28](https://github.com/zxu28)

## 🎯 Future Enhancements

- [ ] Add difficulty levels to Number Game
- [ ] Implement multiplayer mode
- [ ] Add more text analysis features to Sentence Counter
- [ ] Create web interface versions
- [ ] Add unit tests

---

*Happy coding! 🚀*
