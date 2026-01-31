#!/bin/bash

# Colors
ORANGE='\033[38;5;208m'
CYAN='\033[0;36m'
RESET='\033[0m'

# Trap Ctrl+C
trap 'echo -e "\n"; exit 0' INT

echo -e "${ORANGE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${ORANGE}  Press ${CYAN}'r'${ORANGE} at any time to reload the script${RESET}"
echo -e "${ORANGE}  Press ${CYAN}Ctrl+C${ORANGE} to exit${RESET}"
echo -e "${ORANGE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# Function to run the main script
run_script() {
    bun run src/index.ts
}

# Main loop
while true; do
    # Run the script (NOT in background, wait for it to finish)
    run_script
    EXIT_CODE=$?
    
    # After script finishes, show reload option
    echo ""
    
    if [ $EXIT_CODE -eq 0 ]; then
        # Script completed successfully
        echo -e "${CYAN}✓ Done! Press 'r' to run again or Ctrl+C to exit...${RESET}"
    else
        # Script failed
        echo -e "${ORANGE}✗ Script exited with code $EXIT_CODE${RESET}"
        echo -e "Press ${CYAN}'r'${RESET} to retry or ${CYAN}Ctrl+C${RESET} to exit..."
    fi
    
    # Wait for user input
    while true; do
        read -n 1 -s key
        if [[ "$key" == "r" ]] || [[ "$key" == "R" ]]; then
            echo ""
            echo -e "${ORANGE}⟳ Reloading script...${RESET}"
            echo ""
            sleep 0.5
            break
        fi
    done
done
