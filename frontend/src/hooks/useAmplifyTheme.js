import { useTheme as useMuiTheme } from "@mui/material";

export const useAmplifyTheme = () => {
  const { palette } = useMuiTheme();

  return {
    name: "Auth Theme",
    tokens: {
      colors: {
        border: {
          error: {
            value: palette.error.main,
          },
        },
        brand: {
          primary: {
            80: { value: palette.primary.dark },
            90: { value: palette.primary.main },
            100: { value: palette.primary.dark },
          },
        },
      },
      components: {
        text: {
          error: {
            color: { value: palette.error.main },
          },
        },
      },
    },
  };
};

export default useAmplifyTheme;
