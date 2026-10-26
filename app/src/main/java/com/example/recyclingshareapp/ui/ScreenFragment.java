package com.example.recyclingshareapp.ui;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import com.example.recyclingshareapp.MainActivity;

/** Each destination has its own editable native XML layout. */
public class ScreenFragment extends Fragment {
    public static ScreenFragment create(String destination, int layout) {
        ScreenFragment fragment = new ScreenFragment();
        Bundle args = new Bundle(); args.putString("destination", destination); args.putInt("layout", layout);
        fragment.setArguments(args); return fragment;
    }
    @Nullable @Override public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle state) {
        return inflater.inflate(requireArguments().getInt("layout"), container, false);
    }
    @Override public void onViewCreated(@NonNull View view, @Nullable Bundle state) {
        ((MainActivity) requireActivity()).bindScreen(view, requireArguments().getString("destination"));
    }
}
