def sentence_counter():
    """
    A program that counts words in a sentence entered by the user.
    """
    
    print("=" * 30)
    print("SENTENCE COUNTER")
    print("=" * 30)
    
    # Get sentence from user
    sentence = input("Enter a sentence: ").strip()
    
    if not sentence:
        print("No sentence entered!")
        return
    
    # Count words (split by whitespace)
    words = sentence.split()
    word_count = len(words)
    
    # Display results
    print(f"\nWord count: {word_count}")
    print("=" * 30)

def main():
    """
    Main program loop
    """
    print("Welcome to Sentence Counter!")
    
    while True:
        sentence_counter()
        
        play_again = input("\nCount words in another sentence? (y/n): ").lower().strip()
        if play_again not in ['y', 'yes']:
            print("Thanks for using Sentence Counter!")
            break

if __name__ == "__main__":
    main()
