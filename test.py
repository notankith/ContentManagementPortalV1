import requests
import datetime
import pytz
import time

# === CONFIG ===
ACCESS_TOKEN = "EAAMVrwZBedl8BPzZCA34SMbnxCTQP8cPnFEQ3PiYa20nTTt3XN0dRg1FGUrMiyncMY4tw1nK6udYnxR1DEx9YBDpDpKRUyY3ZBnusKyZBlws5fjIdZAtVx2OLuvk0wSJAhFnaGFnZA0ERiOg4I4KXqeEH4QHjWaw6jKUwHEpySayvdVteVjHnNely7z8kGhn6CFgZDZD"
PAGE_ACCESS_TOKEN = "EAAMVrwZBedl8BP9U9dSynEVAnBaIOztptYwbJNiQ4vgi2H85tmGBJRireZCM3cv4h2ZAOJTG46XFXxuW4bwRNoOXlyHrADicnqroB9gtxm2PHbiSHxeWccifjEzHgxGyL64KIoVSadmeONL4DCnGrDmKt7U8fRsb5zXAwOLqHCyNgu15gQUQ9wbiZBBfjqumTAAZD"

PAGE_ID = "100390181377848"
IG_USER_ID = "17841478169805616"

IMAGE_URL = "https://upload.wikimedia.org/wikipedia/commons/6/6d/Windows_Settings_app_icon.png"
CAPTION = "🔥 Scheduled dual post from ScheduleHoopRadar! #automation #scheduler"

API_BASE = "https://graph.facebook.com/v21.0"

# === Calculate UTC timestamp for today 22:00 IST ===
ist = pytz.timezone("Asia/Kolkata")
now_ist = datetime.datetime.now(ist)
schedule_ist = now_ist.replace(hour=22, minute=0, second=0, microsecond=0)
if schedule_ist < now_ist:
    schedule_ist += datetime.timedelta(days=1)
schedule_utc = schedule_ist.astimezone(pytz.utc)
schedule_timestamp = int(schedule_utc.timestamp())

# === Instagram Scheduled Post ===
def schedule_instagram(image_url, caption, publish_at):
    print("\n📸 Scheduling Instagram post...")
    create_url = f"{API_BASE}/{IG_USER_ID}/media"
    params = {
        "image_url": image_url,
        "caption": caption,
        "publish_at": publish_at,  # UTC seconds
        "access_token": ACCESS_TOKEN,
    }
    res = requests.post(create_url, params=params)
    data = res.json()
    print("Create response:", data)
    if "id" in data:
        print(f"✅ IG media container scheduled (id: {data['id']})")
        return data['id']
    else:
        print("❌ Failed to create IG media container.")
        return None

# === Facebook Scheduled Post (robust) ===
def schedule_facebook(image_url, caption, scheduled_publish_time):
    print("\n📘 Scheduling Facebook post...")
    url = f"{API_BASE}/{PAGE_ID}/photos"
    params = {
        "url": image_url,
        "caption": caption,
        "published": "false",
        "scheduled_publish_time": scheduled_publish_time,
        "access_token": PAGE_ACCESS_TOKEN,
    }
    res = requests.post(url, params=params)
    data = res.json()
    print("FB raw response:", data)

    # Accept either 'post_id' (common) or 'id' (returned by some endpoints)
    if "post_id" in data:
        print(f"✅ Facebook scheduled (post_id): {data['post_id']}")
        return data['post_id']
    if "id" in data:
        # API sometimes returns the photo id — not the final post id.
        # For photos, scheduled post id may be constructed later; still treat 'id' as success.
        photo_id = data['id']
        print(f"✅ Facebook returned id (photo id): {photo_id}")
        # Attempt to construct a permalink-like id: {page_id}_{post_id} may not be available yet.
        # Return the raw id so caller can query later for post status.
        return photo_id

    # if there's an error field, return it for diagnostics
    if "error" in data:
        print("❌ Facebook scheduling error:", data["error"])
    else:
        print("❌ Unexpected FB response shape.")
    return None

def main():
    print("🚀 Scheduling dual post for 10 PM IST...")
    print(f"IST schedule: {schedule_ist}  |  UTC ts: {schedule_timestamp}")

    ig_media_id = schedule_instagram(IMAGE_URL, CAPTION, schedule_timestamp)
    fb_result = schedule_facebook(IMAGE_URL, CAPTION, schedule_timestamp)

    print("\n=== RESULTS ===")
    if ig_media_id:
        print(f"Instagram Scheduled Media ID → {ig_media_id}")
    if fb_result:
        # If FB returned 'post_id' it's in the form page_postid; if it's a raw photo id, we'll just show it.
        print(f"Facebook scheduling result → {fb_result}")
    print("\n✅ Done.")

if __name__ == "__main__":
    main()