psql -d flcf -c "COPY (SELECT row_to_json(t) FROM offsets t) TO STDOUT" > offsets.json

# run locally

npm run dev:all - starts server and frontend
