# Smart Wage Worker - Natural Voice MP3s

To complete the natural human voice integration, place your high-quality MP3 recordings into this `audio` directory. The structure and naming convention must exactly match what the application expects.

## Directory Structure

```
public/
  audio/
    en/    <-- English MP3s go here
    hi/    <-- Hindi MP3s go here
    te/    <-- Telugu MP3s go here
```

## Required Files

Inside each language folder (`en`, `hi`, `te`), you must provide the following `.mp3` files:

### Landing Page & Login
- `landing_demo.mp3` - The 20s welcome voice demo on the landing page
- `phone_number.mp3` - "Please enter your phone number"
- `i_am_worker.mp3` - "I am a worker"
- `i_am_employer.mp3` - "I am an employer"
- `verification_code_sent.mp3` - "SMS verification code has been sent"

### Welcome Guide (First Login)
- `welcome_1.mp3` - "Welcome to Smart Wage Worker!"
- `welcome_2.mp3` - "This is the login section..."

### Worker Dashboard Guide
- `worker_dashboard_welcome.mp3`
- `worker_dashboard_quick_actions.mp3`
- `worker_dashboard_recommendations.mp3`
- `worker_dashboard_apps.mp3`

### Employer Dashboard Guide
- `employer_dashboard_welcome.mp3`
- `employer_dashboard_post.mp3`
- `employer_dashboard_active.mp3`

### Implementation Steps
1. Create directories `en/`, `hi/`, and `te/` in this folder.
2. Ensure your audio files are exactly named as above.
3. Test by running the application and clicking the "Listen" or "Voice Demo" buttons. The application will fetch and play the MP3!
