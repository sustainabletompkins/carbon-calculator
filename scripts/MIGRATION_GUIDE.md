# Offsets JSON to Firestore Migration Guide

## Overview

This migration script transforms offset records from `offsets.json` (JSONL format) and uploads them to your Firestore database as a collection called `offsets`.

## Prerequisites

1. **Environment Variables**: Ensure your `.env` file contains the required Firebase configuration:

   ```
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

2. **Source Data**: The `offsets.json` file should be in JSONL format (one JSON object per line)

3. **Firestore Database**: Your Firebase project should have Firestore enabled

## Schema Mapping

The script maps the source JSON fields to the following Firestore schema:

| Source Field          | Firestore Field     | Type           | Notes                    |
| --------------------- | ------------------- | -------------- | ------------------------ |
| `id`                  | `id`                | number         | Used as document ID      |
| `user_id`             | `userId`            | number or null |                          |
| `title`               | `title`             | string         |                          |
| `pounds`              | `pounds`            | number         | Converted to float       |
| `cost`                | `cost`              | number         | Converted to float       |
| `purchased`           | `purchased`         | boolean        |                          |
| `name`                | `name`              | string         |                          |
| `zipcode`             | `zipcode`           | number or null | Converted to integer     |
| `created_at`          | `createdAt`         | timestamp      | Converted to Date object |
| `updated_at`          | `updatedAt`         | timestamp      | Converted to Date object |
| `email`               | `email`             | string         |                          |
| `team_id`             | `teamId`            | number         | Default: 0               |
| `individual_id`       | `individualId`      | number         | Default: 0               |
| `region_id`           | `regionId`          | number or null |                          |
| `checkout_session_id` | `checkoutSessionId` | string or null |                          |
| `offset_type`         | `offsetType`        | string or null |                          |
| `offset_interval`     | `offsetInterval`    | string or null |                          |

## Running the Migration

### Option 1: Using npm script

```bash
npm run migrate:offsets
```

### Option 2: Direct Node execution

```bash
node scripts/migrateOffsetsToFirestore.js
```

## What the Script Does

1. **Reads** the `offsets.json` file line by line (JSONL format)
2. **Validates** each JSON record
3. **Transforms** the data to match Firestore schema:
   - Converts snake_case to camelCase
   - Converts ISO date strings to Date objects
   - Handles null values properly
   - Ensures correct data types
4. **Batches** uploads (500 records per batch) for efficiency
5. **Reports** progress and any errors

## Output

The script will display:

- Number of records loaded
- Sample of the original and transformed data
- Progress updates as batches are uploaded
- Final summary with success/error counts

### Example Output:

```
Reading offsets from: /home/kinovate/sites/carbon-calculator/offsets.json
Loaded 2661 offset records from file

Sample record (before transformation):
{
  "id": 11964,
  "user_id": 0,
  "title": "",
  ...
}

Sample record (after transformation):
{
  "id": 11964,
  "userId": 0,
  "title": "",
  ...
}

Ready to upload 2661 records to Firestore collection 'offsets'
Press Ctrl+C to cancel, or wait 5 seconds to continue...

✓ Uploaded batch 1 (500 total records)
✓ Uploaded batch 2 (1000 total records)
✓ Uploaded batch 3 (1500 total records)
...

✅ Migration complete!
   Successfully uploaded: 2661 records
   Errors: 0
```

## Troubleshooting

### Firebase Connection Error

- Verify all environment variables are correctly set
- Check that your Firebase project is active
- Ensure Firestore database is enabled in your Firebase project

### File Not Found Error

- Confirm `offsets.json` exists in the project root
- Check file permissions

### Parse Error

- Verify the `offsets.json` file is in valid JSONL format
- Each line must be a complete, valid JSON object

### Rate Limiting

- If you hit Firestore write limits, the script will report errors
- Wait before retrying, or split the migration into smaller batches

## Batch Processing Details

- **Batch Size**: 500 records per Firestore batch
- **Why Batching**: Firestore has a limit of 500 operations per batch write
- **Performance**: Batching improves upload speed and reduces individual transaction overhead

## Rollback

To remove the uploaded data, you can:

1. Delete the entire `offsets` collection from Firestore console
2. Or selectively delete documents using Firestore GUI

## Security Notes

- The script requires valid Firebase credentials from your `.env` file
- Never commit your `.env` file to version control
- Ensure proper Firebase security rules are in place before migration

## Data Verification

After migration, verify the data in Firestore:

1. Go to Firebase Console → Firestore
2. Navigate to the `offsets` collection
3. Sample a few documents to ensure data looks correct
4. Check the document count matches: 2661 records

## Support

If you encounter issues:

1. Check the error messages in console output
2. Verify environment variables and Firebase setup
3. Ensure `offsets.json` file format is correct
4. Review Firebase security rules and permissions
