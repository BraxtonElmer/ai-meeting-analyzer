import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from tabulate import tabulate

# Load environment variables
load_dotenv()

# Get database connection string
database_url = os.getenv('DATABASE_URL')

def display_table_data(table_name, cursor):
    print(f"\n=== Table: {table_name} ===")
    
    # Get all rows from the table
    cursor.execute(f'SELECT * FROM {table_name}')
    rows = cursor.fetchall()
    
    if not rows:
        print("No data in table")
        return
        
    # Get column names
    columns = [desc[0] for desc in cursor.description]
    
    # Print data in tabular format
    print(tabulate(rows, headers=columns, tablefmt='grid'))

def main():
    try:
        # Connect to database
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get all table names
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        
        tables = cursor.fetchall()
        
        # Display data for each table
        for table in tables:
            table_name = table['table_name']
            display_table_data(table_name, conn.cursor())
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

if __name__ == "__main__":
    main()
