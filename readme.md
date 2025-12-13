מבנה הפרויקט - docs/project_structre
רעיונות לכלים ושדרוגים - docs/ideas

debug block:
הבוט מציג הודעת debug
אחרי כל תשובה כדי להראות איך הוא הגיע לתשובה ובאיזה כלי הוא התשמש
אנחנו יכולים לבטל את זה בקלות דרך ה 
env



מה הבוט כרגע יכל לעשות:
tool || example || info

get:

get all products || "show me all my products" || (מביא את כל המוצרים בחנות)
get by id || "show me product 1848" || (מביא מוצר לפי id)
get by sku || "show me product headphones-992" || (מביא מוצר לפי sku)
get products by name || "show me product mouse" || (מביא את כל המוצרים עם השם הזה)
get products by category || "show me all the products in category Electronics" || מביא מוצרים לפי קטגוריה

------------------------------------------------------

add:

create a new product || "lets create a product" ||
הבוט ישאל אם ליצור מוצר מגייסון קיים או אם להנחות את המשתמש לפי השדות
json: || "json" || (מצב "json")
הדבקת בלוק גייסון לדוגמא : 
{ "type": "simple", "name": "Test Wizard Tshirt", "status": "draft", "regular_price": "99.90", "sale_price": "79.90", "description": "Full description for the test wizard tshirt. You can replace this with real content.", "short_description": "Short teaser for the test wizard tshirt.", "sku": "wizard tshirt 001", "manage_stock": true, "stock_quantity": 25, "stock_status": "instock", "backorders": "no", "low_stock_amount": 3, "sold_individually": false, "weight": "0.5", "dimensions": { "length": "30", "width": "20", "height": "3" }, "shipping_class": "", "categories": [ { "name": "Shirts" }, { "name": "Summer" } ], "tags": [ { "name": "wizard demo" }, { "name": "tshirt" } ], "virtual": false, "downloadable": false, "downloads": [], "download_limit": 0, "download_expiry": 0, "upsell_ids": [], "cross_sell_ids": [], "grouped_products": [], "featured": false, "catalog_visibility": "visible", "reviews_allowed": true, "purchase_note": "Thank you for your purchase", "menu_order": 0, "parent_id": 0, "meta_data": [ { "key": "brand", "value": "Wizard Wear" }, { "key": "color", "value": "Purple" } ], "tax_status": "taxable", "tax_class": "", "external_url": "", "button_text": "" }

wizard: || "wizard" || (מצב "wizard")
הבוט יעבור למצב הנחיה וירשום כל שלב שדה ושדה והמשתמש יענה עם מה שירצה.
אם המשתמש לא ירצה להוסיף שדה שהבוט מציע הוא יוכל לרשום
skip
ואם ירצה לבטל יוכל לרשום
cancel
אחרי שדות החובה הבוט ישאל אם המשתמש רוצה להוסיף שדות מתקדמות וימשיך.

בסיום יצירת המוצר מאחד המצבים המשתמש יתבקש לאשר את היצירה ולבחור עם לעלות את המוצר ב 
publish או draft
הבוט יוסיף את המוצר ויראה אותו בצאט


----------------------------------------------------------

update:
update by id || "lets update product 1848" ||
הבוט ישאל איזה שדות המשתמש ירצה לשנות
המשתמש ירשום לדוגמא 
regular_price
ואז ירשום מחיר לשינוי 
יפתח חלון אישור שמראה את השינויים ומבקש מהמשתמש לאשר

בנסוף המשתמש יוכל לרשום ישר את השדות שירצה לשנות כך
"lets update product 1848 regular price to 188"

update by sku || "lets update product speaker-mini-441" || כרגע עדיין לא עובד כמו שצריך

bulk update || "increase all my products regular price by 10%" || עדכון שדה של כל המוצרים ביחד
שדות שניתן לשנות:
regular_price, sale_price, status, stock_status, manage_stock, stock_quantity, backorders, catalog_visibility, featured, reviews_allowed, purchase_note, tax_status, tax_class

אפשר גם לרשום "update all my products"
והבוט ישאל איזה שדה לשנות
נרשום לדוגמא "stock_quantity"
הבוט ישאל איזה פעולה נרצה לעשות
increase/decrease/set
נרשום לדוגמא "set"
ואז למה המשתמש ירצה לשנות
"200"

catgory bulk update:
אפשר גם לעשות פעולת bulk update 
על כתגוריה מסויים לדוגמא:
"update all products price in category Electronics to 200"
"increase all products prices in category Electronics by 10%"

יפתח חלונות לאישור בכל פעולה 
--------------------------

delete:
כרגע אין פעולות מחיקה
נוסיף במהשך פעולות מחיקה והעברה לסל מחזור