// ---------------------------------------------------------------------------
// Starter datasets. Loaded into IndexedDB once on first launch.
// Users can extend all of these from within the app (exercise/food editors).
// ---------------------------------------------------------------------------

// Shared goal checklist options - referenced by onboarding and the profile screen.
const GOAL_OPTIONS = [
  { key: "general_fitness", label: "General fitness" },
  { key: "strength", label: "Build strength" },
  { key: "fat_loss", label: "Fat loss" },
  { key: "muscle_gain", label: "Muscle gain" },
  { key: "endurance", label: "Endurance / conditioning" },
  { key: "pt_test_prep", label: "APFT/ACFT test prep" },
];

const SEED_EXERCISES = [
  // Calisthenics - Push
  { id: "ex_pushup", name: "Push-Up", category: "calisthenics", muscleGroup: "chest/triceps", type: "reps", equipment: "none", instructions: "Hands under shoulders, body in a straight line, lower chest to floor, press back up." },
  { id: "ex_diamond_pushup", name: "Diamond Push-Up", category: "calisthenics", muscleGroup: "triceps", type: "reps", equipment: "none", instructions: "Hands together under chest forming a diamond, lower and press up." },
  { id: "ex_pike_pushup", name: "Pike Push-Up", category: "calisthenics", muscleGroup: "shoulders", type: "reps", equipment: "none", instructions: "Hips high, body in inverted V, lower head toward floor, press back up." },
  { id: "ex_dips", name: "Bench/Bar Dips", category: "calisthenics", muscleGroup: "triceps/chest", type: "reps", equipment: "bar or bench", instructions: "Lower body by bending elbows, press back to full extension." },

  // Calisthenics - Pull
  { id: "ex_pullup", name: "Pull-Up", category: "calisthenics", muscleGroup: "back/biceps", type: "reps", equipment: "pull-up bar", instructions: "Dead hang, pull chin above bar, lower with control." },
  { id: "ex_chinup", name: "Chin-Up", category: "calisthenics", muscleGroup: "back/biceps", type: "reps", equipment: "pull-up bar", instructions: "Underhand grip, pull chin above bar." },
  { id: "ex_inverted_row", name: "Inverted Row", category: "calisthenics", muscleGroup: "back", type: "reps", equipment: "bar or rings", instructions: "Body straight under a bar, pull chest to bar." },

  // Calisthenics - Legs
  { id: "ex_squat", name: "Bodyweight Squat", category: "calisthenics", muscleGroup: "legs", type: "reps", equipment: "none", instructions: "Feet shoulder-width, sit hips back and down, drive up through heels." },
  { id: "ex_lunge", name: "Walking Lunge", category: "calisthenics", muscleGroup: "legs", type: "reps", equipment: "none", instructions: "Step forward, lower back knee toward floor, alternate legs." },
  { id: "ex_pistol_squat", name: "Pistol Squat", category: "calisthenics", muscleGroup: "legs", type: "reps", equipment: "none", instructions: "Single-leg squat, other leg extended forward." },
  { id: "ex_glute_bridge", name: "Glute Bridge", category: "calisthenics", muscleGroup: "glutes", type: "reps", equipment: "none", instructions: "Lie on back, knees bent, drive hips up squeezing glutes." },

  // Calisthenics - Core
  { id: "ex_plank", name: "Plank", category: "calisthenics", muscleGroup: "core", type: "time", equipment: "none", instructions: "Forearms and toes on floor, body straight, hold." },
  { id: "ex_situp", name: "Sit-Up", category: "calisthenics", muscleGroup: "core", type: "reps", equipment: "none", instructions: "Knees bent, feet anchored, curl torso to knees." },
  { id: "ex_hanging_leg_raise", name: "Hanging Leg Raise", category: "calisthenics", muscleGroup: "core", type: "reps", equipment: "pull-up bar", instructions: "Hang from bar, raise legs to horizontal or higher." },
  { id: "ex_mountain_climber", name: "Mountain Climber", category: "calisthenics", muscleGroup: "core/cardio", type: "time", equipment: "none", instructions: "Plank position, drive knees alternately toward chest." },

  // Military PT specific
  { id: "ex_hand_release_pushup", name: "Hand-Release Push-Up (ACFT)", category: "military", muscleGroup: "chest/triceps", type: "reps", equipment: "none", instructions: "Standard push-up; at the bottom, lift both hands off the ground before pressing up." },
  { id: "ex_sprint_drag_carry", name: "Sprint-Drag-Carry (ACFT)", category: "military", muscleGroup: "full body", type: "time", equipment: "sled, kettlebells", instructions: "5 shuttles: sprint, sled drag, lateral shuffle, kettlebell carry, sprint." },
  { id: "ex_deadlift_acft", name: "3-Rep Max Deadlift (ACFT)", category: "military", muscleGroup: "posterior chain", type: "weight", equipment: "hex bar", instructions: "Trap-bar deadlift, 3-rep max." },
  { id: "ex_standing_power_throw", name: "Standing Power Throw (ACFT)", category: "military", muscleGroup: "full body/power", type: "distance", equipment: "medicine ball", instructions: "Backward overhead throw of a 10lb medicine ball for distance." },
  { id: "ex_plank_acft", name: "Plank (ACFT)", category: "military", muscleGroup: "core", type: "time", equipment: "none", instructions: "Hold a forearm plank for maximum time." },
  { id: "ex_two_mile_run", name: "2-Mile Run (APFT)", category: "military", muscleGroup: "cardio", type: "time", equipment: "none", instructions: "Timed 2-mile run on a flat course." },
  { id: "ex_two_mile_run_acft", name: "2-Mile Run (ACFT)", category: "military", muscleGroup: "cardio", type: "time", equipment: "none", instructions: "ACFT timed 2-mile run event." },
  { id: "ex_formation_run", name: "Formation Run", category: "military", muscleGroup: "cardio", type: "time", equipment: "none", instructions: "Group run in cadence, typically 2-4 miles." },
  { id: "ex_ruck_march", name: "Ruck March", category: "military", muscleGroup: "full body/cardio", type: "distance", equipment: "rucksack (35lb standard)", instructions: "Timed march carrying a loaded rucksack, standard load 35lb over set distance." },
  { id: "ex_buddy_carry", name: "Buddy Carry", category: "military", muscleGroup: "full body", type: "distance", equipment: "partner", instructions: "Carry a partner of similar weight over a set distance using a fireman or piggyback carry." },
  { id: "ex_bear_crawl", name: "Bear Crawl", category: "military", muscleGroup: "full body", type: "distance", equipment: "none", instructions: "Crawl forward on hands and feet, hips low, core braced." },
];

const SEED_FOODS = [
  { id: "food_chicken_breast", name: "Chicken Breast, cooked", servingSize: 100, servingUnit: "g", calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { id: "food_white_rice", name: "White Rice, cooked", servingSize: 100, servingUnit: "g", calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { id: "food_brown_rice", name: "Brown Rice, cooked", servingSize: 100, servingUnit: "g", calories: 123, protein: 2.6, carbs: 26, fat: 1 },
  { id: "food_egg", name: "Egg, large", servingSize: 50, servingUnit: "g", calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8 },
  { id: "food_oats", name: "Rolled Oats, dry", servingSize: 40, servingUnit: "g", calories: 150, protein: 5, carbs: 27, fat: 3 },
  { id: "food_banana", name: "Banana", servingSize: 118, servingUnit: "g", calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { id: "food_almonds", name: "Almonds", servingSize: 28, servingUnit: "g", calories: 164, protein: 6, carbs: 6, fat: 14 },
  { id: "food_greek_yogurt", name: "Greek Yogurt, plain nonfat", servingSize: 170, servingUnit: "g", calories: 100, protein: 17, carbs: 6, fat: 0.7 },
  { id: "food_ground_beef", name: "Ground Beef 90/10, cooked", servingSize: 100, servingUnit: "g", calories: 176, protein: 20, carbs: 0, fat: 10 },
  { id: "food_sweet_potato", name: "Sweet Potato, baked", servingSize: 100, servingUnit: "g", calories: 90, protein: 2, carbs: 21, fat: 0.1 },
  { id: "food_broccoli", name: "Broccoli, steamed", servingSize: 100, servingUnit: "g", calories: 35, protein: 2.4, carbs: 7, fat: 0.4 },
  { id: "food_peanut_butter", name: "Peanut Butter", servingSize: 32, servingUnit: "g", calories: 190, protein: 8, carbs: 7, fat: 16 },
  { id: "food_whey_protein", name: "Whey Protein Powder", servingSize: 30, servingUnit: "g", calories: 120, protein: 24, carbs: 3, fat: 1.5 },
  { id: "food_mre_menu1", name: "MRE - Menu 1 (Chili & Macaroni), whole", servingSize: 1, servingUnit: "meal", calories: 1250, protein: 46, carbs: 140, fat: 51 },
  { id: "food_whole_wheat_bread", name: "Whole Wheat Bread", servingSize: 32, servingUnit: "g", calories: 80, protein: 4, carbs: 14, fat: 1 },
  { id: "food_olive_oil", name: "Olive Oil", servingSize: 14, servingUnit: "g", calories: 120, protein: 0, carbs: 0, fat: 14 },
  { id: "food_black_beans", name: "Black Beans, cooked", servingSize: 100, servingUnit: "g", calories: 132, protein: 8.9, carbs: 24, fat: 0.5 },
  { id: "food_salmon", name: "Salmon, cooked", servingSize: 100, servingUnit: "g", calories: 208, protein: 20, carbs: 0, fat: 13 },
  { id: "food_apple", name: "Apple", servingSize: 182, servingUnit: "g", calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  { id: "food_cottage_cheese", name: "Cottage Cheese, low-fat", servingSize: 113, servingUnit: "g", calories: 90, protein: 12, carbs: 5, fat: 2 },
];

// Sample military meal plan templates, tied to training phase/goal.
const SEED_MEAL_PLANS = [
  {
    id: "plan_cut_2000",
    name: "Fat-Loss Phase - ~2000 kcal",
    goal: "cut",
    targetCalories: 2000,
    targetProtein: 170,
    targetCarbs: 170,
    targetFat: 60,
    meals: [
      { name: "Breakfast", items: ["food_oats", "food_egg", "food_banana"] },
      { name: "Lunch", items: ["food_chicken_breast", "food_brown_rice", "food_broccoli"] },
      { name: "Dinner", items: ["food_salmon", "food_sweet_potato", "food_broccoli"] },
      { name: "Snack", items: ["food_greek_yogurt", "food_almonds"] },
    ],
  },
  {
    id: "plan_maintain_2600",
    name: "Sustainment Phase - ~2600 kcal",
    goal: "maintain",
    targetCalories: 2600,
    targetProtein: 180,
    targetCarbs: 280,
    targetFat: 80,
    meals: [
      { name: "Breakfast", items: ["food_oats", "food_egg", "food_peanut_butter"] },
      { name: "Lunch", items: ["food_ground_beef", "food_white_rice", "food_black_beans"] },
      { name: "Dinner", items: ["food_chicken_breast", "food_sweet_potato", "food_broccoli"] },
      { name: "Snack", items: ["food_whey_protein", "food_banana"] },
    ],
  },
  {
    id: "plan_ruck_3200",
    name: "Ruck / Field Phase - ~3200 kcal",
    goal: "high-output",
    targetCalories: 3200,
    targetProtein: 190,
    targetCarbs: 380,
    targetFat: 95,
    meals: [
      { name: "Breakfast", items: ["food_oats", "food_egg", "food_banana", "food_peanut_butter"] },
      { name: "Lunch", items: ["food_mre_menu1"] },
      { name: "Dinner", items: ["food_ground_beef", "food_white_rice", "food_black_beans", "food_olive_oil"] },
      { name: "Snack", items: ["food_whey_protein", "food_almonds", "food_apple"] },
    ],
  },
];

// APFT (push-ups / sit-ups / 2-mile run) and ACFT (6-event) scoring tables.
// These are abbreviated reference tables (sampled data points, age group 22-26,
// standard/moderate scale) clearly labeled in-app as reference-only, not an
// official system-of-record score. Users can extend/replace with full tables.
const SEED_PT_SCORING = {
  apft: {
    label: "APFT (reference scale, age 22-26)",
    events: {
      pushups_male: { min: 42, max: 77, minScore: 60, maxScore: 100 },
      pushups_female: { min: 19, max: 42, minScore: 60, maxScore: 100 },
      situps_male: { min: 53, max: 82, minScore: 60, maxScore: 100 },
      situps_female: { min: 53, max: 82, minScore: 60, maxScore: 100 },
      run_seconds_male: { min: 720, max: 976, minScore: 100, maxScore: 60, inverted: true }, // 12:00 (100) to 16:16 (60)
      run_seconds_female: { min: 852, max: 1122, minScore: 100, maxScore: 60, inverted: true }, // 14:12 to 18:42
    },
    passScore: 60,
    maxTotal: 300,
  },
  acft: {
    label: "ACFT (reference scale)",
    events: [
      { key: "deadlift_lb", name: "3-Rep Max Deadlift (lb)", min: 140, max: 340, minScore: 60, maxScore: 100 },
      { key: "power_throw_m", name: "Standing Power Throw (m)", min: 4.5, max: 12.5, minScore: 60, maxScore: 100 },
      { key: "hrp_reps", name: "Hand-Release Push-Ups (reps)", min: 10, max: 60, minScore: 60, maxScore: 100 },
      { key: "sdc_seconds", name: "Sprint-Drag-Carry (sec)", min: 90, max: 250, minScore: 100, maxScore: 60, inverted: true },
      { key: "plank_seconds", name: "Plank (sec)", min: 90, max: 220, minScore: 60, maxScore: 100 },
      { key: "run_seconds", name: "2-Mile Run (sec)", min: 780, max: 1320, minScore: 100, maxScore: 60, inverted: true },
    ],
    passScorePerEvent: 60,
    maxTotal: 600,
  },
};
