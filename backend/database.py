import sqlite3
import bcrypt

DB_NAME = "users.db"

def get_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS Users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            phone_number TEXT,
            age INTEGER,
            gender TEXT,
            height REAL,
            weight REAL,
            activity_level TEXT,
            bmi REAL,
            health_goal TEXT,
            allergies TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS SavedRecipes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            recipe_name TEXT,
            ingredients TEXT,
            instructions TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS ShoppingList (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            recipe_name TEXT DEFAULT 'General',
            item_name TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS History (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            recipe_name TEXT NOT NULL,
            calories INTEGER,
            protein INTEGER,
            carbs INTEGER,
            fat INTEGER,
            cost_rm REAL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES Users(id)
        )
    ''')
    # Seed admin — use bcrypt for secure hashing
    admin_pw = hash_password("Admin@1234")
    existing = c.execute("SELECT id FROM Users WHERE username=?", ("Admin",)).fetchone()
    if not existing:
        c.execute("""
            INSERT INTO Users (username, password, phone_number, age, gender, height, weight, activity_level, bmi, health_goal)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, ("Admin", admin_pw, "", 30, "Male", 170, 65, "Sedentary (Little to no exercise)", 22.5, "Maintain Current Weight"))
    conn.commit()
    conn.close()

def hash_password(password):
    """Hash a password using bcrypt with automatic salt generation."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password, hashed):
    """Verify a password against its bcrypt hash. Also handles legacy SHA-256 migration."""
    import hashlib
    # If the stored hash is a legacy SHA-256 hex digest (64 chars, no $), migrate on login
    if len(hashed) == 64 and not hashed.startswith("$"):
        return hashlib.sha256(password.encode()).hexdigest() == hashed
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def migrate_password(username, password):
    """Re-hash a password with bcrypt after successful legacy SHA-256 login."""
    conn = get_connection()
    conn.execute("UPDATE Users SET password=? WHERE username=?", (hash_password(password), username))
    conn.commit()
    conn.close()

def add_user(username, password, phone_number, age, gender, height, weight, activity_level, bmi, health_goal, allergies=""):
    conn = get_connection()
    try:
        conn.execute('''INSERT INTO Users 
            (username, password, phone_number, age, gender, height, weight, activity_level, bmi, health_goal, allergies)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (username, hash_password(password), phone_number, age, gender, height, weight, activity_level, bmi, health_goal, allergies))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def login_user(username, password):
    conn = get_connection()
    user = conn.execute('SELECT * FROM Users WHERE username=?', (username,)).fetchone()
    conn.close()
    if not user:
        return None
    user_dict = dict(user)
    if not verify_password(password, user_dict["password"]):
        return None
    # Migrate legacy SHA-256 hash to bcrypt on successful login
    if len(user_dict["password"]) == 64 and not user_dict["password"].startswith("$"):
        migrate_password(username, password)
    return user_dict

def update_user_profile(username, phone_number, age, gender, height, weight, activity_level, bmi, health_goal, allergies):
    conn = get_connection()
    conn.execute('''UPDATE Users SET phone_number=?, age=?, gender=?, height=?, weight=?,
        activity_level=?, bmi=?, health_goal=?, allergies=? WHERE username=?''',
        (phone_number, age, gender, height, weight, activity_level, bmi, health_goal, allergies, username))
    conn.commit()
    conn.close()

def log_meal(user_id, recipe_name, calories, protein, carbs, fat, cost_rm):
    conn = get_connection()
    conn.execute('''INSERT INTO History (user_id, recipe_name, calories, protein, carbs, fat, cost_rm)
        VALUES (?, ?, ?, ?, ?, ?, ?)''', (user_id, recipe_name, calories, protein, carbs, fat, cost_rm))
    conn.commit()
    conn.close()

def get_history(user_id):
    conn = get_connection()
    rows = conn.execute('SELECT * FROM History WHERE user_id=? ORDER BY timestamp DESC', (user_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_user_aggregated_stats(user_id, start_date=None, end_date=None):
    conn = get_connection()
    query = "SELECT SUM(calories) as total_cal, SUM(cost_rm) as total_cost FROM History WHERE user_id=?"
    params = [user_id]
    
    if start_date and end_date:
        query += " AND timestamp >= ? AND timestamp <= ?"
        params.extend([start_date + " 00:00:00", end_date + " 23:59:59"])
        
    row = conn.execute(query, params).fetchone()
    conn.close()
    
    return {
        "total_calories": int(row["total_cal"] or 0),
        "total_cost": round(float(row["total_cost"] or 0), 2)
    }

def save_recipe(username, recipe_name, ingredients_json, instructions_json):
    conn = get_connection()
    conn.execute('INSERT INTO SavedRecipes (username, recipe_name, ingredients, instructions) VALUES (?, ?, ?, ?)',
        (username, recipe_name, ingredients_json, instructions_json))
    conn.commit()
    conn.close()

def get_saved_recipes(username):
    conn = get_connection()
    rows = conn.execute('SELECT id, recipe_name, ingredients, instructions FROM SavedRecipes WHERE username=?', (username,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_recipe(recipe_id):
    conn = get_connection()
    conn.execute('DELETE FROM SavedRecipes WHERE id=?', (recipe_id,))
    conn.commit()
    conn.close()

def get_shopping_list(username):
    conn = get_connection()
    rows = conn.execute('SELECT id, recipe_name, item_name FROM ShoppingList WHERE username=?', (username,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def add_shopping_items(username, recipe_name, items):
    conn = get_connection()
    for item in items:
        conn.execute('INSERT INTO ShoppingList (username, recipe_name, item_name) VALUES (?, ?, ?)', (username, recipe_name, item))
    conn.commit()
    conn.close()

def delete_shopping_item(item_id):
    conn = get_connection()
    conn.execute('DELETE FROM ShoppingList WHERE id=?', (item_id,))
    conn.commit()
    conn.close()

def get_all_users():
    conn = get_connection()
    rows = conn.execute(
        "SELECT id, username, phone_number, age, gender, height, weight, bmi, health_goal, activity_level, allergies FROM Users"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_user(user_id):
    conn = get_connection()
    conn.execute("DELETE FROM History WHERE user_id=?", (user_id,))
    conn.execute("DELETE FROM SavedRecipes WHERE username=(SELECT username FROM Users WHERE id=?)", (user_id,))
    conn.execute("DELETE FROM ShoppingList WHERE username=(SELECT username FROM Users WHERE id=?)", (user_id,))
    conn.execute("DELETE FROM Users WHERE id=?", (user_id,))
    conn.commit()
    conn.close()

def reset_user_password(user_id, new_password):
    conn = get_connection()
    conn.execute("UPDATE Users SET password=? WHERE id=?", (hash_password(new_password), user_id))
    conn.commit()
    conn.close()

def get_user_history(user_id):
    conn = get_connection()
    rows = conn.execute(
        "SELECT recipe_name, calories, cost_rm, timestamp FROM History WHERE user_id=? ORDER BY timestamp DESC LIMIT 10",
        (user_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_stats():
    conn = get_connection()
    total_users = conn.execute("SELECT COUNT(*) as c FROM Users").fetchone()["c"]
    total_meals = conn.execute("SELECT COUNT(*) as c FROM History").fetchone()["c"]
    total_savings = conn.execute("SELECT ROUND(SUM(cost_rm),2) as s FROM History").fetchone()["s"] or 0
    meals_today = conn.execute(
        "SELECT COUNT(*) as c FROM History WHERE DATE(timestamp)=DATE('now')"
    ).fetchone()["c"]
    health_dist = conn.execute(
        "SELECT health_goal, COUNT(*) as count FROM Users GROUP BY health_goal"
    ).fetchall()
    top_recipes = conn.execute(
        "SELECT recipe_name, COUNT(*) as count FROM History GROUP BY recipe_name ORDER BY count DESC LIMIT 5"
    ).fetchall()
    hourly = conn.execute(
        "SELECT strftime('%H', datetime(timestamp, '+8 hours')) as hour, COUNT(*) as count FROM History GROUP BY hour ORDER BY hour"
    ).fetchall()
    conn.close()
    return {
        "total_users": total_users,
        "total_meals": total_meals,
        "total_savings": total_savings,
        "meals_today": meals_today,
        "health_distribution": [dict(r) for r in health_dist],
        "top_recipes": [dict(r) for r in top_recipes],
        "hourly_activity": [dict(r) for r in hourly]
    }