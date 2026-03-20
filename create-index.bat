@echo off
echo Creating Vector Index on Firestore...
gcloud firestore indexes composite create --project=pavelknox-b5781 --collection-group=knowledge_chunks --query-scope=COLLECTION --field-config field-path=embedding,vector-config="""{""dimension"":""1536"",""flat"": ""{}""}"""
echo Done.
pause
