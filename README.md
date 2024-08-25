# dSigner

THIRDWEB + SUPABASE

## Test in Postman

[<img src="https://run.pstmn.io/button.svg" alt="Run In Postman" style="width: 128px; height: 32px;">](https://god.gw.postman.com/run-collection/5476508-270a4f46-0305-4868-b58c-576db17d46c6?action=collection%2Ffork&source=rip_markdown&collection-url=entityId%3D5476508-270a4f46-0305-4868-b58c-576db17d46c6%26entityType%3Dcollection%26workspaceId%3Dbad8e770-94de-4c28-9dbc-9ef030d123b4)


## Set-up your SUPABASE

### 1. Create table `wallets`

Create table as follows
> For policies, only allow `SERVICE_ROLE` to read and write this table

| Columns    | Type       | Default Value     | Primary | Additional Settings    |
|------------|------------|-------------------|---------|------------------------|
| id         | int8       | now()             | Yes     | Is Unique, Is Identity |
| created_at | timestampz | gen_random_uuid() |         |                        |
| user_id    | uuid       |                   |         | Is Unique              |
| email      | text       |                   |         | Is Unique              |
| wallet     | text       |                   |         | Is Unique              |


### 2. Set Site URL

Navigate to `Authentication` > `URL Configuration`

Then enter `{{baseURL}}/auth/welcome` in `Site URL`


## Set-up this repo

```bash
git clone https://github.com/domecloud/dSigner.git
cd dSigner
npm i
cp .env.example .env
node index.js
```
Don't forget to edit `.env` file