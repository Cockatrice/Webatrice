import { useForm, Controller } from 'react-hook-form';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';

import { InputField } from '@app/components';

interface SayMessageValues {
  message: string;
}

interface SayMessageProps {
  onSubmit: (args: { message: string }) => void;
}

const SayMessage = ({ onSubmit }: SayMessageProps) => {
  const { control, handleSubmit, reset } = useForm<SayMessageValues>({
    defaultValues: { message: '' },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => {
        onSubmit(values);
        reset();
      })}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', p: '5px', gap: '5px' }}>
        <Box sx={{ flex: 1 }}>
          <Controller
            name="message"
            control={control}
            render={({ field, fieldState }) => (
              <InputField
                {...field}
                label="Chat"
                error={fieldState.error?.message}
                touched={fieldState.isTouched}
              />
            )}
          />
        </Box>
        <Button color="primary" variant="contained" type="submit">Send</Button>
      </Box>
    </form>
  );
};

export default SayMessage;
