import { useForm, Controller } from 'react-hook-form';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';

import { InputField } from '@app/components';

interface AddUserFormValues {
  userName: string;
}

interface AddUserFormProps {
  label: string;
  onSubmit: (values: AddUserFormValues) => void;
}

const AddUserForm = ({ label, onSubmit }: AddUserFormProps) => {
  const { control, handleSubmit, reset } = useForm<AddUserFormValues>({
    defaultValues: { userName: '' },
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
            name="userName"
            control={control}
            render={({ field, fieldState }) => (
              <InputField
                {...field}
                label={label}
                error={fieldState.error?.message}
                touched={fieldState.isTouched}
              />
            )}
          />
        </Box>
        <Button color="primary" variant="contained" type="submit">Add</Button>
      </Box>
    </form>
  );
};

export default AddUserForm;
