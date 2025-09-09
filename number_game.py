import random

def number_removal_game():
    """
    A game where the computer generates a random starting number between 20-30.
    Player and computer take turns removing 1, 2, or 3 from the number.
    The player who has to remove the last value (bringing it to 0) loses.
    """
    
    # Generate random starting number between 20-30
    starting_number = random.randint(20, 30)
    current_number = starting_number
    
    print("=" * 30)
    print("NUMBER REMOVAL GAME")
    print("=" * 30)
    print(f"Starting number: {starting_number}")
    print("Remove 1, 2, or 3. Last to remove LOSES!")
    print("=" * 30)
    
    # Game loop
    while current_number > 0:
        print(f"\nCurrent number: {current_number}")
        
        # Player's turn
        if current_number <= 0:
            break
            
        while True:
            try:
                player_move = int(input(f"How many do you want to remove (1-3)? "))
                if player_move in [1, 2, 3] and player_move <= current_number:
                    current_number -= player_move
                    print(f"You removed {player_move}. {current_number} left.")
                    break
                elif player_move > current_number:
                    print(f"Can't remove {player_move}. Only {current_number} left!")
                else:
                    print("Enter 1, 2, or 3!")
            except ValueError:
                print("Enter a valid number!")
        
        # Check if player lost
        if current_number == 0:
            print("\nGAME OVER! You LOSE!")
            break
        
        # Computer's turn
        import time
        time.sleep(1)  # Brief pause
        
        # Advanced AI strategy: Optimal play based on game theory
        remainder = current_number % 4
        
        if remainder == 1:
            computer_move = 1
        elif remainder == 0:
            computer_move = min(3, current_number)
        elif remainder == 2:
            computer_move = 1
        else:  # remainder == 3
            computer_move = 2
        
        current_number -= computer_move
        print(f"Computer removes {computer_move}. {current_number} left.")
        
        # Check if computer lost
        if current_number == 0:
            print("\nGAME OVER! You WIN!")
            break

def play_again():
    """Ask if player wants to play again"""
    while True:
        choice = input("\nWould you like to play again? (y/n): ").lower().strip()
        if choice in ['y', 'yes']:
            return True
        elif choice in ['n', 'no']:
            return False
        else:
            print("Please enter 'y' or 'n'")

if __name__ == "__main__":
    print("Welcome to the Number Removal Game!")
    
    while True:
        number_removal_game()
        
        if not play_again():
            print("\nThanks for playing! Goodbye!")
            break
