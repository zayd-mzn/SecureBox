"""
Save avatars from database to actual image files
"""

from app import create_app
from app.extensions import db
from app.models import User
import base64
import os

def save_avatars_to_files():
    app = create_app()
    
    with app.app_context():
        # Create directory for avatars
        avatar_dir = 'extracted_avatars'
        os.makedirs(avatar_dir, exist_ok=True)
        
        users = User.query.all()
        
        print("=" * 70)
        print("📸 Extracting avatars from database...")
        print("=" * 70)
        
        saved_count = 0
        
        for user in users:
            if user.avatar_base64:
                try:
                    # Extract base64 data (remove the data URL prefix)
                    if ',' in user.avatar_base64:
                        header, data = user.avatar_base64.split(',', 1)
                        # Determine file extension from mime type
                        ext = user.avatar_mime_type.split('/')[-1] if user.avatar_mime_type else 'png'
                    else:
                        data = user.avatar_base64
                        ext = 'png'
                    
                    # Decode base64 to binary
                    image_data = base64.b64decode(data)
                    
                    # Save to file
                    filename = f"{avatar_dir}/{user.username}_avatar.{ext}"
                    with open(filename, 'wb') as f:
                        f.write(image_data)
                    
                    print(f"✅ Saved: {filename}")
                    saved_count += 1
                    
                except Exception as e:
                    print(f"❌ Error saving avatar for {user.username}: {e}")
            else:
                print(f"⚠️  No avatar for {user.username}")
        
        print("\n" + "=" * 70)
        print(f"📊 SUMMARY: Saved {saved_count} avatars to '{avatar_dir}' folder")
        print("=" * 70)
        print("\n📁 You can now open the 'extracted_avatars' folder to see the images!")

if __name__ == "__main__":
    save_avatars_to_files()