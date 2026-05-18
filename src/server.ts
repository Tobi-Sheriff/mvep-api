import { app } from './app';
import { config } from './config';

app.listen(config.PORT, () => {
  console.log(`Server running on http://localhost:${config.PORT} [${config.NODE_ENV}]`);
});
