-- DEVELOPMENT delete of employees and articles (the API refuses it in production). RLS still
-- limits every delete to the caller's own tenant.
GRANT DELETE ON "employees", "articles", "person_documents" TO acrms_app;
