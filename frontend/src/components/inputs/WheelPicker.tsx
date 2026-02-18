import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 3;

interface WheelPickerProps {
  items: { label: string; value: string | number }[];
  selectedValue: string | number;
  onValueChange: (value: string | number) => void;
  width?: number;
}

export default function WheelPicker({
  items,
  selectedValue,
  onValueChange,
  width = 100,
}: WheelPickerProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  
  // Find the index of the selected value
  const selectedIndex = items.findIndex(item => item.value === selectedValue);
  
  // Scroll to selected item on mount and when selectedValue changes
  useEffect(() => {
    if (scrollViewRef.current && selectedIndex >= 0 && !isScrolling) {
      scrollViewRef.current.scrollTo({
        y: selectedIndex * ITEM_HEIGHT,
        animated: false,
      });
    }
  }, [selectedIndex]);

  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    
    if (index >= 0 && index < items.length) {
      const newValue = items[index].value;
      if (newValue !== selectedValue) {
        onValueChange(newValue);
      }
    }
  };

  const handleMomentumScrollEnd = (event: any) => {
    setIsScrolling(false);
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    
    // Snap to nearest item
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: index * ITEM_HEIGHT,
        animated: true,
      });
    }
    
    if (index >= 0 && index < items.length) {
      onValueChange(items[index].value);
    }
  };

  const handleScrollBegin = () => {
    setIsScrolling(true);
  };

  const handleItemPress = (index: number) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: index * ITEM_HEIGHT,
        animated: true,
      });
    }
    onValueChange(items[index].value);
  };

  return (
    <View style={[styles.container, { width }]}>
      {/* Selection indicator */}
      <View style={styles.selectionIndicator} pointerEvents="none" />
      
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBegin}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingVertical: ITEM_HEIGHT,
        }}
      >
        {items.map((item, index) => {
          const isSelected = index === selectedIndex;
          return (
            <TouchableOpacity
              key={`${item.value}-${index}`}
              style={styles.item}
              onPress={() => handleItemPress(index)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.itemText,
                  isSelected && styles.itemTextSelected,
                  !isSelected && styles.itemTextFaded,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    position: 'relative',
    overflow: 'hidden',
  },
  selectionIndicator: {
    position: 'absolute',
    top: ITEM_HEIGHT,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: 'rgba(30, 60, 114, 0.08)',
    borderRadius: 8,
    zIndex: 1,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  itemTextSelected: {
    fontWeight: '600',
    color: '#1e3c72',
  },
  itemTextFaded: {
    color: '#9CA3AF',
    fontSize: 18,
  },
});
