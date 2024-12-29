import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  FlatList,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { requestNotificationPermissions, scheduleTaskReminder, cancelTaskNotification, scheduleDailyNotification } from '../services/notificationService';

const HomeScreen = ({ navigation }) => {
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [userName, setUserName] = useState('');

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const response = await api.getTasks();
      setTasks(response);
      // Schedule notifications for all incomplete tasks
      response.forEach(task => {
        if (!task.status) {
          scheduleTaskReminder(task);
        }
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch tasks');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.getCategories();
      // Add "All" category at the beginning
      setCategories([
        { id: null, title: 'All Tasks' },
        ...response
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch categories');
    }
  };

  useEffect(() => {
    requestNotificationPermissions();
    loadUserName();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchTasks();
      fetchCategories();
    });

    return unsubscribe;
  }, [navigation]);

  const loadUserName = async () => {
    try {
      const name = await AsyncStorage.getItem('userName');
      setUserName(name || 'User');
    } catch (error) {
      console.log('Error loading user name:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      navigation.replace('Login');
    } catch (error) {
      Alert.alert('Error', 'Failed to logout');
    }
  };

  const handleToggleStatus = async (taskId, currentStatus) => {
    setIsUpdating(true);
    try {
      const newStatus = !currentStatus;
      await api.updateTaskStatus(taskId, newStatus);
      // Update local state
      setTasks(prevTasks =>
        prevTasks.map(task => {
          if (task.id === taskId) {
            const updatedTask = { ...task, status: newStatus };
            // Update notification when task status changes
            scheduleTaskReminder(updatedTask);
            return updatedTask;
          }
          return task;
        })
      );
      Alert.alert('Success', `Task marked as ${newStatus ? 'completed' : 'incomplete'}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update task status');
      console.error('Update status error:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEditTask = (task) => {
    navigation.navigate('NewTask', { task, isEditing: true });
  };

  const handleDeleteTask = async (taskId) => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsUpdating(true);
            try {
              await api.deleteTask(taskId);
              setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
              // Cancel any scheduled notifications for the deleted task
              await cancelTaskNotification(taskId);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete task');
              console.error('Delete task error:', error);
            } finally {
              setIsUpdating(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.categoryItem,
        selectedCategory === item.id && styles.categoryItemActive,
      ]}
      onPress={() => setSelectedCategory(item.id)}
    >
      <Text
        style={[
          styles.categoryItemText,
          selectedCategory === item.id && styles.categoryItemTextActive,
        ]}
      >
        {item.title}
      </Text>
    </TouchableOpacity>
  );

  const filteredTasks = tasks.filter(task => 
    selectedCategory === null || task.category_id === selectedCategory
  );

  const TaskCard = ({ task }) => {
    const handleStatusChange = async () => {
      setIsUpdating(true);
      try {
        await api.updateTaskStatus(task.id, !task.status);
        setTasks(prevTasks =>
          prevTasks.map(t =>
            t.id === task.id
              ? { ...t, status: !task.status }
              : t
          )
        );
        // Update notification when task status changes
        scheduleTaskReminder({ ...task, status: !task.status });
      } catch (error) {
        Alert.alert('Error', 'Failed to update task status');
      } finally {
        setIsUpdating(false);
      }
    };

    const handleDelete = () => {
      Alert.alert(
        'Delete Task',
        'Are you sure you want to delete this task?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setIsUpdating(true);
              try {
                await api.deleteTask(task.id);
                setTasks(prevTasks => prevTasks.filter(task => task.id !== task.id));
                // Cancel any scheduled notifications for the deleted task
                await cancelTaskNotification(task.id);
              } catch (error) {
                Alert.alert('Error', 'Failed to delete task');
              } finally {
                setIsUpdating(false);
              }
            },
          },
        ],
        { cancelable: true }
      );
    };

    return (
      <View style={styles.taskCard}>
        <View style={styles.taskHeader}>
          <View style={styles.taskTitleContainer}>
            <TouchableOpacity 
              onPress={handleStatusChange}
              style={styles.statusButton}
            >
              <View style={[styles.statusIndicator, task.status && styles.statusCompleted]} />
            </TouchableOpacity>
            <Text style={styles.taskTitle} numberOfLines={1}>
              {task.title}
            </Text>
          </View>
          <View style={styles.taskActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate('NewTask', { task, isEditing: true })}
              style={styles.actionButton}
            >
              <Icon name="pencil" size={18} color="#4169E1" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDelete}
              style={styles.actionButton}
            >
              <Icon name="trash-can-outline" size={18} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        </View>
        
        <Text style={styles.taskDate}>
            <Icon name="calendar" size={14} color="#666" style={styles.dateIcon} />
            {`${new Date(task.due_date).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}, ${new Date(task.due_date).toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true, // Ensures AM/PM format
            })}`}
          </Text>


        
        {task.description ? (
          <Text style={styles.taskDescription} numberOfLines={2}>
            {task.description}
          </Text>
        ) : null}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4169E1" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FD" />
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>{userName}</Text>
        </View>
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout}
        >
          <Icon name="logout-variant" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>

      <View style={styles.categoriesContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          renderItem={renderCategoryItem}
          keyExtractor={item => item.id?.toString() || 'all'}
          contentContainerStyle={styles.categoriesList}
        />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <View style={[styles.sectionDot, { backgroundColor: '#4169E1' }]} />
              <Text style={styles.sectionTitle}>
                In Progress ({filteredTasks.filter(t => !t.status).length})
              </Text>
            </View>
          </View>
          
          {filteredTasks
            .filter(task => !task.status)
            .map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <View style={[styles.sectionDot, { backgroundColor: '#00C48C' }]} />
              <Text style={styles.sectionTitle}>
                Completed ({filteredTasks.filter(t => t.status).length})
              </Text>
            </View>
          </View>
          
          {filteredTasks
            .filter(task => task.status)
            .map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
        </View>
      </ScrollView>

      <TouchableOpacity 
        style={styles.createButton}
        onPress={() => navigation.navigate('NewTask')}
      >
        <Icon name="plus-circle" size={24} color="white" style={styles.createButtonIcon} />
        <Text style={styles.createButtonText}>Add New Task</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FD',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FD',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  userInfo: {
    gap: 2,
  },
  greeting: {
    fontSize: 13,
    color: '#666',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  logoutButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  categoriesContainer: {
    marginVertical: 12,
  },
  categoriesList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'white',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryItemActive: {
    backgroundColor: '#4169E1',
    borderColor: '#4169E1',
  },
  categoryItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  categoryItemTextActive: {
    color: 'white',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  taskCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  taskTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
  },
  statusButton: {
    padding: 6,
    marginLeft: -6,
  },
  statusIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFA500',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  statusCompleted: {
    backgroundColor: '#4CAF50',
  },
  editButton: {
    padding: 6,
    marginLeft: 6,
  },
  taskDate: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateIcon: {
    marginRight: 4,
  },
  taskDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  taskActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F8F9FD',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4169E1',
    margin: 24,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#4169E1',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  createButtonIcon: {
    width: 20,
    height: 20,
    tintColor: 'white',
    marginRight: 8,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreen;